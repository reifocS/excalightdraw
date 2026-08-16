import { useEffect, useState } from "react";

export const MOBILE_MEDIA_QUERY = "(max-width: 720px)";

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
