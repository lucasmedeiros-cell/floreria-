import { Storefront } from "@/components/Storefront";
import { RoseIntro } from "@/components/RoseIntro";
import { readAnimConfig } from "@/lib/animStore";

export const dynamic = "force-dynamic";

export default async function Home() {
  const anim = await readAnimConfig();
  return (
    <>
      <RoseIntro enabled={anim.web} />
      <Storefront />
    </>
  );
}
