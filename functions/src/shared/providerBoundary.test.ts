import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? sources(file) : file.endsWith(".ts") && !file.endsWith(".test.ts") ? [file] : [];
  });
}

it("keeps every OpenAI constructor and raw provider call behind the consent transport", () => {
  const root = join(__dirname, "..");
  const violations: string[] = [];
  for (const file of sources(root)) {
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
    const names = new Map<string, string>();
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause?.name) {
        names.set(statement.importClause.name.text, statement.moduleSpecifier.text);
      }
    }
    const visit = (node: ts.Node) => {
      if (ts.isNewExpression(node) && node.expression.getText(source) === "OpenAI" && !names.get("OpenAI")?.endsWith("consentedOpenAI")) {
        violations.push(relative(root, file) + ": unguarded OpenAI constructor");
      }
      if (ts.isCallExpression(node) && node.expression.getText(source) === "fetch" && node.arguments.some((arg) => /api\.openai\.com|serpapi\.com/.test(arg.getText(source)))) {
        violations.push(relative(root, file) + ": unguarded provider fetch");
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  expect(violations).toEqual([]);
});
