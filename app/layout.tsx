import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'MarketingGen AI · Your next growth story', description: 'An intelligent workspace for personalized campaigns, audience intelligence, and conversion optimization.' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
