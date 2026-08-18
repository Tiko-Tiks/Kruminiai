import { redirect } from "next/navigation";

// Liepto puslapis perkeltas į bendrą projektų maršrutą /projektai/[slug].
// Senasis adresas paliekamas – jis atspausdintas plakatuose, išsiųstas SMS
// žinutėse ir naudojamas viešose nuorodose. Plakatas /lieptas/spausdinti
// lieka savo vietoje (atskiras vaikinis maršrutas, redirect'as jo neliečia).
export default function LieptasPage() {
  redirect("/projektai/lieptas");
}
