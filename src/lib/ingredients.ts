// 성분명 안의 숫자 위치 표기(예: 1,2-헥산다이올)는 쉼표 구분자가 아닙니다.
export function ingredientNames(value: string): string[] {
  const protectedCommas: string[] = [];
  const text = value
    .normalize("NFKC")
    .replace(/\b\d+(?:,\s*\d+)+-/g, (name) => {
      const index = protectedCommas.push(name.replace(/,\s*/g, ",")) - 1;
      return `\u0000${index}\u0000`;
    });
  return text
    .split(/[,;\n\r]+/)
    .map((name) =>
      name
        .trim()
        .replace(
          /\u0000(\d+)\u0000/g,
          (_, index: string) => protectedCommas[Number(index)],
        ),
    )
    .filter(Boolean);
}
