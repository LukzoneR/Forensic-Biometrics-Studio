import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import html2canvas from "html2canvas";
import { PDFDocument } from "pdf-lib";

export const ensureImagesLoaded = async (
    container: HTMLElement
): Promise<void> => {
    const images = Array.from(container.querySelectorAll("img"));
    await Promise.all(
        images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise<void>(resolve => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
            });
        })
    );
};

export const renderPagesToPdf = async (
    root: HTMLElement,
    pages: HTMLElement[],
    saveTitle: string,
    defaultFileName: string
): Promise<void> => {
    pages.forEach(page => root.appendChild(page));
    document.body.appendChild(root);

    try {
        await ensureImagesLoaded(root);
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
                const pdfPage = pdf.addPage([canvas.width, canvas.height]);
                pdfPage.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: canvas.width,
                    height: canvas.height,
                });
                chain.push(pdfPage);
                return chain;
            },
            Promise.resolve([] as ReturnType<typeof pdf.addPage>[])
        );

        const pdfBytes = await pdf.save();

        const filePath = await save({
            title: saveTitle,
            filters: [{ name: "PDF", extensions: ["pdf"] }],
            canCreateDirectories: true,
            defaultPath: defaultFileName,
        });

        if (!filePath) return;

        await writeFile(filePath, pdfBytes);
    } finally {
        root.remove();
    }
};
