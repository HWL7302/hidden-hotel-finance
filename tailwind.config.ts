import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#2f2d4a",
        paper: "#f5f7f9",
        pine: "#48b8b0",
        brass: "#5fc9c1",
        slateblue: "#34324a"
      }
    }
  },
  plugins: []
};

export default config;
