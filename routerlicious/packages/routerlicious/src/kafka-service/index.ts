import * as path from "path";
import { execute } from "./command";
import { KafkaResourcesFactory } from "./resourcesFactory";

execute(
    (name: string, lambda: string) => new KafkaResourcesFactory(name, lambda),
    path.join(__dirname, "../../config/config.json"));
