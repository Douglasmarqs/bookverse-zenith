import JSZip from "jszip";
/** Test-only documents; never included in the catalog or production routes. */
export async function createEpubFixture({
  version = 3,
  paragraphs = 60,
  rtl = false,
  fixed = false,
} = {}) {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file(
    "META-INF/container.xml",
    '<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  zip.file(
    "OPS/book.opf",
    `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">bookverse-qa</dc:identifier><dc:title>EPUB de teste local</dc:title><dc:creator>QA Bookverse</dc:creator><dc:language>${rtl ? "ar" : "pt"}</dc:language>${fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ""}</metadata><manifest><item id="one" href="Text/one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="Text/two.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/></manifest><spine toc="ncx" page-progression-direction="${rtl ? "rtl" : "ltr"}"><itemref idref="one"/><itemref idref="two"/></spine></package>`,
  );
  zip.file(
    "OPS/nav.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="Text/one.xhtml">Parte um</a><ol><li><a href="Text/one.xhtml#section">Trecho importante</a></li></ol></li><li><a href="Text/two.xhtml#note">Notas finais</a></li></ol></nav></body></html>',
  );
  zip.file(
    "OPS/toc.ncx",
    '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint><navLabel><text>Parte um EPUB 2</text></navLabel><content src="Text/one.xhtml"/><navPoint><navLabel><text>Trecho importante</text></navLabel><content src="Text/one.xhtml#section"/></navPoint></navPoint><navPoint><navLabel><text>Notas finais EPUB 2</text></navLabel><content src="Text/two.xhtml#note"/></navPoint></navMap></ncx>',
  );
  if (version === 2) zip.remove("OPS/nav.xhtml");
  zip.file(
    "OPS/Text/one.xhtml",
    `<html xmlns="http://www.w3.org/1999/xhtml" dir="${rtl ? "rtl" : "ltr"}"><head><title>Início do teste</title><style>body{position:fixed;background:red}</style></head><body><h1 id="begin">Início do teste</h1><p>Um documento criado somente para testar importação e leitura.</p>${Array.from({ length: paragraphs }, (_, i) => `<p${i === 30 ? ' id="section"' : ""}>Parágrafo de teste ${i + 1}. Este texto permite conferir paginação, mudança de fonte e retomada da posição. A biblioteca deve guardar este documento somente no ambiente local de testes.</p>`).join("")}<p>Consulte a <a href="two.xhtml#note">nota final</a> e depois retorne.</p><script>window.__epubAttack = true;</script></body></html>`,
  );
  zip.file(
    "OPS/Text/two.xhtml",
    '<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Notas</title></head><body><h1>Notas</h1><p id="note">Esta nota é o destino de um link interno.</p><p><a href="one.xhtml#section">Voltar ao trecho importante</a></p></body></html>',
  );
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
