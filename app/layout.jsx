import { Toaster } from 'react-hot-toast';
import './globals.css';

export const metadata = {
  title: 'VTO Vertex — Virtual Try-On Studio',
  description: 'AI-powered virtual try-on using Google Vertex AI Imagen',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
      </body>
    </html>
  );
}
