"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uk"><body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
      <div style={{ textAlign: "center", padding: 24 }}><h1>Щось пішло не так</h1><p style={{ color: "#666" }}>Спробуйте оновити сторінку.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "12px 20px", borderRadius: 10, border: 0, background: "#111", color: "#fff", cursor: "pointer" }}>Спробувати ще</button></div>
    </body></html>
  );
}
