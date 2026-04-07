import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#f4f6f1",
        ink: "#1f2420",
        moss: "#2e6f5e",
        mist: "#d7e9df",
      },
      boxShadow: {
        panel: "0 20px 50px rgba(29, 42, 36, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
