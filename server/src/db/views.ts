import { Promise } from "es6-promise";
import { IView } from "../interfaces";
import * as connection from "./connection";

const collectionName = "views";

let collection = connection.getOrCreateCollection<IView>(collectionName);

/**
 * Searches for the given string in the collection
 */
export function search(type: string): Promise<IView[]> {
    return collection.query("SELECT * FROM views WHERE views.type=@type", [{ name: "@type", value: type }]);
}

/**
 * Retrieves all the views stored in the DB
 */
export function getAll(): Promise<IView[]> {
    return collection.getAll();
}
