export function paymentWhatsApp(tournament: string, team: string, amount: number) {
  const text = `Hi OG Gaming, I paid PKR ${amount.toLocaleString('en-PK')} for ${tournament}. Team: ${team}. I am attaching my payment screenshot for verification.`;
  return 'https://wa.me/923062779481?text=' + encodeURIComponent(text);
}
