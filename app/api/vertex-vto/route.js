import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

async function fetchRemoteImage(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    return { base64, mimeType };
}

export async function POST(req) {
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || "gen-lang-client-0044079183";
    const location = process.env.GOOGLE_CLOUD_REGION || process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

    // On Vercel, we can't upload the JSON file easily. 
    // Instead, we read the JSON string from GOOGLE_CREDENTIALS and write it to a temporary file.
    if (process.env.GOOGLE_CREDENTIALS) {
        const fs = require('fs');
        const path = require('path');
        const os = require('os');
        const tmpPath = path.join(os.tmpdir(), 'vto_vertex_key.json');
        fs.writeFileSync(tmpPath, process.env.GOOGLE_CREDENTIALS);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    if (!projectId || !location) {
        return NextResponse.json(
            { success: false, error: "GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_LOCATION is not configured." },
            { status: 500 }
        );
    }

    try {
        const body = await req.json();
        const { personImage, clothingImage, clothingImageUrl } = body;

        if (!personImage) {
            return NextResponse.json({ success: false, error: "Missing personImage" }, { status: 400 });
        }
        if (!clothingImage && !clothingImageUrl) {
            return NextResponse.json({ success: false, error: "Missing clothingImage or clothingImageUrl" }, { status: 400 });
        }

        const client = new GoogleGenAI({ vertexai: true, project: projectId, location });

        // Person image — strip data URI prefix
        const personData = personImage.split(',')[1];

        // Clothing image — fetch from URL or use base64 directly
        let clothingData;
        let clothingMimeType = 'image/jpeg';

        if (clothingImageUrl) {
            const fetched = await fetchRemoteImage(clothingImageUrl);
            clothingData = fetched.base64;
            clothingMimeType = fetched.mimeType;
        } else {
            clothingData = clothingImage.split(',')[1];
            const mimeMatch = clothingImage.match(/^data:(.*?);base64,/);
            if (mimeMatch?.[1]) clothingMimeType = mimeMatch[1];
        }

        const personImagePart = { imageBytes: personData, mimeType: 'image/jpeg' };
        const clothingImagePart = { imageBytes: clothingData, mimeType: clothingMimeType };

        const vtoParams = {
            model: 'virtual-try-on-001',
            source: {
                personImage: personImagePart,
                productImages: [{ productImage: clothingImagePart }],
            },
            config: {
                outputMimeType: 'image/jpeg',
                numberOfImages: 1,
                safetyFilterLevel: 'BLOCK_LOW_AND_ABOVE',
            },
        };

        let response;
        const { models } = client;

        if (typeof models.recontextImage === 'function') {
            response = await models.recontextImage(vtoParams);
        } else if (typeof models.recontext_image === 'function') {
            response = await models.recontext_image(vtoParams);
        } else {
            const available = models ? Object.keys(models).join(', ') : 'none';
            console.error("VTO method not found. Available:", available);
            return NextResponse.json(
                { success: false, error: "The required VTO method is not available in the current SDK version." },
                { status: 500 }
            );
        }

        const generatedImages = response?.generatedImages;
        if (!Array.isArray(generatedImages) || generatedImages.length === 0) {
            console.error("No generated images:", JSON.stringify(response, null, 2));
            return NextResponse.json({ success: false, error: "No image was generated." }, { status: 500 });
        }

        const firstImage = generatedImages[0].image;
        if (!firstImage) {
            return NextResponse.json({ success: false, error: "Empty image data received." }, { status: 500 });
        }

        let base64String = "";
        if (typeof firstImage.imageBytes === 'string') {
            base64String = firstImage.imageBytes;
        } else if (firstImage.imageBytes) {
            base64String = Buffer.from(firstImage.imageBytes).toString('base64');
        } else {
            return NextResponse.json({ success: false, error: "Unknown image data format." }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            result: `data:image/jpeg;base64,${base64String}`,
        });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("VTO API Error:", msg);
        if (error.status) console.error("Error Status:", error.status);

        return NextResponse.json({ success: false, error: msg }, { status: 500 });
    }
}
