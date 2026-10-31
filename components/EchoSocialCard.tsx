export default function EchoSocialCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #050907 0%, #0b1710 52%, #07100b 100%)",
        color: "#f5fff7",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 480,
          height: 480,
          borderRadius: 240,
          background: "#123d25",
          opacity: 0.34,
          top: -235,
          left: 345,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 430,
          height: 430,
          borderRadius: 215,
          border: "1px solid rgba(130, 255, 170, 0.12)",
          bottom: -260,
          right: -85,
        }}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "42px 66px 48px",
          borderRadius: 42,
          border: "1px solid rgba(129, 255, 167, 0.16)",
          background: "rgba(5, 14, 9, 0.78)",
          boxShadow: "0 28px 90px rgba(0, 0, 0, 0.35)",
        }}
      >
        <span
          style={{
            fontSize: 150,
            fontWeight: 400,
            letterSpacing: -12,
            lineHeight: 1,
            color: "#f0fff4",
          }}
        >
          echo
        </span>
        <div
          style={{
            width: 162,
            height: 150,
            display: "flex",
            alignItems: "center",
            position: "relative",
            marginLeft: 18,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 76,
              width: 94,
              height: 94,
              borderRadius: 47,
              background: "linear-gradient(145deg, #7af5a0, #0c8840)",
              opacity: 0.62,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 38,
              width: 94,
              height: 94,
              borderRadius: 47,
              background: "linear-gradient(145deg, #95ffb6, #19b855)",
              opacity: 0.78,
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 0,
              width: 94,
              height: 94,
              borderRadius: 47,
              background: "linear-gradient(145deg, #c0ffd0, #21c45c)",
              boxShadow: "0 0 42px rgba(53, 220, 111, 0.24)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 34,
          fontSize: 23,
          letterSpacing: 7,
          textTransform: "uppercase",
          color: "#9bb5a2",
        }}
      >
        a playlist made with echo
      </div>
    </div>
  );
}
