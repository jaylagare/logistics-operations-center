import './globals.css';
import type { ReactNode } from 'react';
import { SimProvider } from '@/components/SimProvider';
import { Shell } from '@/components/Shell';

export const metadata = {
  title: 'Hybrid Ops Center · demo',
  description: 'Operations center mock-up with a live exception-agent POC (Hume Highway flooding)',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SimProvider>
          <Shell>{children}</Shell>
        </SimProvider>
      </body>
    </html>
  );
}
