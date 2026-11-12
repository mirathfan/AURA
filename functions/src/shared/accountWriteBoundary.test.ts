import { join, relative } from "node:path";
import ts from "typescript";

it("all privileged data mutations use the transactional fence or the explicit cleanup coordinator", () => {
  const root = join(__dirname, "..", "..");
  const config = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const violations: string[] = [];
  for (const source of program.getSourceFiles()) {
    const file = relative(join(root, "src"), source.fileName).replace(/\\/g, "/");
    if (file.startsWith("..") || source.fileName.includes("node_modules")) continue;
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const type = checker.typeToString(checker.getTypeAtLocation(node.expression.expression));
        if (["set", "update", "create", "add"].includes(method) && /^(DocumentReference|CollectionReference|WriteBatch|BulkWriter)[< ]?/.test(type)) {
          if (file !== "shared/accountDeletionJob.ts") violations.push(`${file}: raw ${type}.${method}`);
        }
        if (method === "runTransaction" && type === "Firestore" && file !== "shared/accountDeletionJob.ts" && file !== "shared/mediaSafety.ts" && !node.getText(source).includes("assertActiveInTransaction(")) {
          violations.push(`${file}: transaction without fence`);
        }
        if (["save", "upload"].includes(method) && ["File", "Bucket"].includes(type) && file !== "shared/accountStorage.ts") {
          violations.push(`${file}: raw Storage upload`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(violations).toEqual([]);
}, 30_000);
