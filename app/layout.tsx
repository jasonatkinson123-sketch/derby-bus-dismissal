import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Derby Middle School · Dismissal',description:'A quieter journey home. Live bus dismissal for Derby Middle School.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
