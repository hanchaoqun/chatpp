import { NextResponse } from "next/server"


export interface PDFDoc {
    name: string,
    text: string,
}

export async function POST(request){
    try {
        const formData = await request.formData();
        const pdfFile = formData.get('pdfFile');

        const parsedPdf = await PDFParse(pdfFile);

        return NextResponse.json(parsedPdf);
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

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

async function PDFParse(pdfFile) {

    const { pdf } = await PDFLoaderImports();
    const buffer = Buffer.from(await pdfFile.arrayBuffer());
    const pdfData = await pdf(buffer);

    let pdfdoc: PDFDoc = {
        name: pdfFile.name,
        text: pdfData.text
    }
    
    // remove \\u0000 -> cannot be converted to text
    pdfdoc.text = pdfdoc.text.replace(/\u0000/g, '');

    return pdfdoc;
}

