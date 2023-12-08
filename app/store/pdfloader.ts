import fs from "fs";

async function PDFLoaderImports() {
    try {
      // the main entrypoint has some debug code that we don't want to import
      const { default: pdf } = await import('pdf-parse/lib/pdf-parse.js');
      return { pdf };
    } catch (e) {
      console.error(e);
      throw new Error(
        'Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`.',
      );
    }
}

export async function PDFParse(pdfile: string) {
      let ret = {
        numpages: 0,
        numrender: 0,
        info: null,
        metadata: null,
        text: "",
        version: null
    };
    let raw = fs.readFileSync(pdfile);
    const { pdf } = await PDFLoaderImports();
    ret = await pdf(raw);
    // remove \\u0000 -> cannot be converted to text
    ret.text = ret.text.replace(/\u0000/g, '');
    return ret;
}