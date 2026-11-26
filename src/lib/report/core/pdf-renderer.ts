import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { ensureImagesLoaded } from "./dom-builder";

export const compilePagesToPdfBytes = async (
    pages: HTMLElement[]
): Promise<Uint8Array> => {
    const pdf = await PDFDocument.create();
    const renderedPages = await Promise.all(
        pages.map(page =>
            html2canvas(page, { scale: 2, backgroundColor: "#ffffff" })
        )
    );

    await renderedPages.reduce(
        async (chainPromise, canvas) => {
            const chain = await chainPromise;
            const pngBytes = canvas.toDataURL("image/png");
            const image = await pdf.embedPng(pngBytes);
            const page = pdf.addPage([canvas.width, canvas.height]);
            page.drawImage(image, {
                x: 0,
                y: 0,
                width: canvas.width,
                height: canvas.height,
            });
            chain.push(page);
            return chain;
        },
        Promise.resolve([] as ReturnType<typeof pdf.addPage>[])
    );

    return pdf.save();
};

export const renderPagesToPdf = async (
    root: HTMLElement,
    pages: HTMLElement[],
    saveTitle: string,
    defaultFileName: string
): Promise<boolean> => {
    pages.forEach(page => root.appendChild(page));
    document.body.appendChild(root);
    try {
        await ensureImagesLoaded(root);
        const pdfBytes = await compilePagesToPdfBytes(pages);

        const filePath = await save({
            title: saveTitle,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
            canCreateDirectories: true,
            defaultPath: defaultFileName,
        });

        if (!filePath) return false;

        await writeFile(filePath, pdfBytes);
        return true;
    } finally {
        root.remove();
    }
};
