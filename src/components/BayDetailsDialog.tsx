'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
type Bay = { tag: string; name: string; desc: string; specs: string[]; games: string[]; status: 'live' | 'soon' };
export function BayDetailsDialog({ bay, onClose, contactUrl }: { bay: Bay | null; onClose: () => void; contactUrl: string }) {
  return <Dialog open={!!bay} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="bay-dialog">{bay && <>
    <DialogHeader><p className="bay-status">{bay.tag} · {bay.status === 'live' ? 'Open for play' : 'Coming soon'}</p><DialogTitle>{bay.name}</DialogTitle><DialogDescription>{bay.desc}</DialogDescription></DialogHeader>
    <section className="bay-section"><h3>Hardware</h3><ul>{bay.specs.map(spec => <li key={spec}>{spec}</li>)}</ul></section>
    <section className="bay-section"><h3>Games</h3><p>{bay.games.join(' · ')}</p></section>
    <div className="bay-actions"><a className="button" href={contactUrl} target="_blank" rel="noopener noreferrer">Contact us</a><button className="button secondary" onClick={onClose}>Close</button></div>
  </>}</DialogContent></Dialog>;
}
