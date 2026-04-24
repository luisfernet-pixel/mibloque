import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 60,
          background:
            "radial-gradient(circle at top left, rgba(14,165,233,0.34), transparent 28%), radial-gradient(circle at top right, rgba(249,115,22,0.24), transparent 22%), linear-gradient(180deg, #07111f 0%, #102844 100%)",
          color: "#f8fafc",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(125, 211, 252, 0.22)",
              color: "#bae6fd",
              fontSize: 28,
              fontWeight: 800,
            }}
          >
            MB
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#a5f3fc",
              }}
            >
              MiBloque
            </div>
            <div style={{ fontSize: 18 }}>
              Software para bloques y condominios
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              maxWidth: 930,
              fontSize: 64,
              fontWeight: 900,
              lineHeight: 1.02,
              letterSpacing: "-0.04em",
            }}
          >
            Cuotas, pagos y avisos en una plataforma lista para vender.
          </div>
          <div
            style={{
              maxWidth: 800,
              fontSize: 26,
              lineHeight: 1.4,
              color: "#cbd5e1",
            }}
          >
            Una experiencia clara para administracion, vecinos y superadmin
            con foco en orden, transparencia y cierre comercial.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {["Cobros", "Pagos", "Gastos", "Avisos", "Transparencia"].map(
            (item) => (
              <div
                key={item}
                style={{
                  padding: "14px 20px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {item}
              </div>
            )
          )}
        </div>
      </div>
    )
  );
}
