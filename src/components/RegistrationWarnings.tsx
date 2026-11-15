export function RegistrationWarnings({ warnings }: { warnings?: string[] }) {
  if (!warnings?.length) return null;
  return (
    <div className="error-message" role="note" aria-label="Roster review warnings">
      <strong>Roster review — verify before approval</strong>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
      <p>Names and unverified contact details are review signals, not proof of identity.</p>
    </div>
  );
}
