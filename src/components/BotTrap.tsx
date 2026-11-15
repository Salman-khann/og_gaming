export function BotTrap() {
  return (
    <div hidden aria-hidden="true">
      <label>
        Leave empty
        <input name="company_website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
