import { useEffect } from "react";
import { installBookOpen } from "@/lib/book-motion";

export function BookOpenOnTap() {
  useEffect(() => installBookOpen(), []);
  return null;
}
