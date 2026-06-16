import { useEffect } from "react";
import Home from "@pages/Home";
import { Toast } from "@ui";

const IDLE_TIMEOUT = 7_000;

export default function App() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const showCursor = () => {
      document.body.classList.remove("cursor-hidden");
      clearTimeout(timer);
      timer = setTimeout(() => {
        document.body.classList.add("cursor-hidden");
      }, IDLE_TIMEOUT);
    };

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, showCursor, { passive: true }));

    timer = setTimeout(() => {
      document.body.classList.add("cursor-hidden");
    }, IDLE_TIMEOUT);

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, showCursor));
      document.body.classList.remove("cursor-hidden");
    };
  }, []);

  return (
    <>
      <Home />
      <Toast />
    </>
  );
}
