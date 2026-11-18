import { describe, expect, it } from "vitest";
import { isDivider, isDividerShortcut, isRich, parseInline, serializeInline, shortUrl } from "./todoText";

describe("parseInline", () => {
  it("teks tanpa link tetap satu segmen", () => {
    expect(parseInline("Promotion > urutan nama")).toEqual([{ text: "Promotion > urutan nama" }]);
    expect(isRich("biasa saja")).toBe(false);
  });

  it("mengenali URL mentah dan membuang tanda baca penutup", () => {
    expect(parseInline("Lihat https://a.com/x?y=1. Lalu")).toEqual([
      { text: "Lihat " },
      { text: "https://a.com/x?y=1", href: "https://a.com/x?y=1", raw: true },
      { text: ". Lalu" },
    ]);
  });

  it("www. diberi https", () => {
    expect(parseInline("www.example.com")[0]).toEqual({ text: "www.example.com", href: "https://www.example.com", raw: true });
  });

  it("kurung penutup yang tidak berpasangan tidak ikut URL", () => {
    expect(parseInline("(lihat https://a.com/b)")[1].href).toBe("https://a.com/b");
    expect(parseInline("https://en.wikipedia.org/wiki/A_(b)")[0].href).toBe("https://en.wikipedia.org/wiki/A_(b)");
  });

  it("mengenali link markdown", () => {
    expect(parseInline("Hasil [Calendar](https://notion.so/x) ok")).toEqual([
      { text: "Hasil " },
      { text: "Calendar", href: "https://notion.so/x", raw: false },
      { text: " ok" },
    ]);
  });
});

describe("format inline", () => {
  it("tebal, miring, highlight", () => {
    expect(parseInline("a **b** *c* _d_ ==e==")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " " },
      { text: "c", italic: true },
      { text: " " },
      { text: "d", italic: true },
      { text: " " },
      { text: "e", mark: true },
    ]);
  });

  it("format bersarang dan link di dalam format", () => {
    expect(parseInline("**tebal *miring***")).toEqual([
      { text: "tebal ", bold: true },
      { text: "miring", bold: true, italic: true },
    ]);
    expect(parseInline("**[Doc](https://a.com)**")).toEqual([{ text: "Doc", href: "https://a.com", raw: false, bold: true }]);
    expect(parseInline("==https://a.com==")[0]).toMatchObject({ href: "https://a.com", mark: true });
  });

  it("tidak salah tangkap", () => {
    expect(isRich("snake_case_name dan 2 * 3 * 4")).toBe(false);
    expect(isRich("** bukan tebal **")).toBe(false);
    expect(parseInline("https://a.com/x_y_z?q=copy_link")[0].href).toBe("https://a.com/x_y_z?q=copy_link");
  });
});

describe("serializeInline", () => {
  const roundTrip = (text: string) => serializeInline(parseInline(text));

  it("format dan link kembali ke teks yang sama", () => {
    expect(roundTrip("a **b** *c* ==d== https://a.com/x?y=1 [Doc](https://b.com)")).toBe(
      "a **b** *c* ==d== https://a.com/x?y=1 [Doc](https://b.com)",
    );
    expect(roundTrip("_c_")).toBe("*c*");
  });

  it("format bersarang dan berdampingan tetap terbaca ulang", () => {
    const runs = [
      { text: "a", bold: true },
      { text: "b", bold: true, italic: true },
      { text: "c", italic: true },
      { text: "d", mark: true, href: "https://x.com" },
    ];
    const text = serializeInline(runs);
    expect(parseInline(text)).toEqual([
      { text: "a", bold: true },
      { text: "b", bold: true, italic: true },
      { text: "c", italic: true },
      { text: "d", href: "https://x.com", raw: false, mark: true },
    ]);
    expect(parseInline(serializeInline([{ text: "a", bold: true }, { text: "c", italic: true }, { text: " d" }]))).toEqual([
      { text: "a", bold: true },
      { text: "c", italic: true },
      { text: " d" },
    ]);
  });

  it("spasi di tepi diletakkan di luar penanda", () => {
    expect(serializeInline([{ text: "a" }, { text: " tebal ", bold: true }, { text: "b" }])).toBe("a **tebal** b");
    expect(serializeInline([{ text: "x", bold: true }, { text: " ", bold: true }, { text: "y" }])).toBe("**x** y");
  });
});

describe("helper", () => {
  it("shortUrl", () => {
    expect(shortUrl("https://www.a.com/p/q?source=copy_link")).toBe("a.com/p/q");
    expect(shortUrl(`https://a.com/${"x".repeat(60)}`, 20)).toHaveLength(20);
  });



  it("divider", () => {
    expect(isDivider("---")).toBe(true);
    expect(isDivider(" --- ")).toBe(true);
    expect(isDivider("----")).toBe(false);
    expect(isDividerShortcut("-- ")).toBe(true);
    expect(isDividerShortcut("--")).toBe(false);
  });
});
