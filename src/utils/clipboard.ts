export async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "true");
  fallback.style.position = "fixed";
  fallback.style.left = "-9999px";
  document.body.appendChild(fallback);

  try {
    fallback.select();
    if (!document.execCommand("copy")) {
      throw new Error("Copying to the clipboard was rejected by the browser");
    }
  } finally {
    fallback.remove();
  }
}
