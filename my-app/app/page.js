// document-signature-app/my-app/app/page.js
import { redirect } from "next/navigation";

export default function HomePage() {
  // Redirect to the login page as the default starting point for the app
  redirect("/login");
}
