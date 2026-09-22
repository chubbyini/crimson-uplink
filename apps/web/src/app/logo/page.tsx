import { notFound } from "next/navigation";
import LogoRoom from "./room";

/**
 * TEMP-DEV review room for perfecting the Sojourner token.
 * Never linked in nav; 404s in production. Delete once the mark ships.
 */
export default function LogoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <LogoRoom />;
}
