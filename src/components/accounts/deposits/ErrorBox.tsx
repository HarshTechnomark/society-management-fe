export function opsErrorBox(failed: string | null) {
  return failed ? (
    <p role="alert" className="rounded-xl bg-[#f6dcda] px-3 py-2 text-[13.5px] text-[#8a1d17]">
      {failed}
    </p>
  ) : null;
}
