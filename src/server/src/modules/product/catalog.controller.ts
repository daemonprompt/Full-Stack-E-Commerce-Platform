import { Request, Response } from "express";
import asyncHandler from "@/shared/utils/asyncHandler";
import sendResponse from "@/shared/utils/sendResponse";
import AppError from "@/shared/errors/AppError";
import { DOMParser } from "xmldom";
import prisma from "@/infra/database/database.config";

/**
 * Catalog import controller
 * Accepts supplier XML feeds and creates/updates products in bulk.
 * XML format: <catalog><product><name/><price/><sku/><description/></product>...</catalog>
 */
export const importCatalog = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const xmlBody = req.body as string;
    if (!xmlBody) throw new AppError(400, "XML body is required");

    // Parse supplier catalog XML
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlBody, "text/xml");

    const productNodes = doc.getElementsByTagName("product");
    const created: string[] = [];

    for (let i = 0; i < productNodes.length; i++) {
      const node = productNodes[i];
      const get = (tag: string) =>
        node.getElementsByTagName(tag)[0]?.textContent ?? "";

      const name = get("name");
      const sku = get("sku");
      const price = parseFloat(get("price")) || 0;
      const description = get("description");

      if (!name || !sku) continue;

      await prisma.product.upsert({
        where: { slug: sku },
        create: { name, slug: sku, price, description },
        update: { name, price, description },
      });
      created.push(sku);
    }

    sendResponse(res, 200, {
      data: { imported: created.length, skus: created },
      message: "Catalog import complete",
    });
  }
);
