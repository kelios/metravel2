import * as ts from 'typescript'

const questScreen = (source: string) => {
  const file = ts.createSourceFile('quest.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const screen = file.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'QuestByIdScreen',
  )
  return { file, screen }
}

/** Loading must always return before a wizard can mount its client-only subtree. */
export const findQuestLoadingGate = (source: string): number => {
  const { file, screen } = questScreen(source)
  const guardsLoading = (expression: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(expression)) return guardsLoading(expression.expression)
    if (ts.isIdentifier(expression)) return expression.text === 'isLoading'
    return ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.BarBarToken
      && (guardsLoading(expression.left) || guardsLoading(expression.right))
  }
  const gate = screen?.body?.statements.find((statement) => {
    if (!ts.isIfStatement(statement) || !guardsLoading(statement.expression)) return false
    const branch = statement.thenStatement
    const returned = ts.isBlock(branch) ? branch.statements[0] : branch
    return returned && ts.isReturnStatement(returned) && returned.expression
      && ts.isJsxSelfClosingElement(returned.expression) && returned.expression.tagName.getText(file) === 'LoadingState'
  })
  return gate?.getStart(file) ?? -1
}

/** Compare mandatory OR operands independently of formatting or added blockers. */
export const questLoadingOperands = (source: string): string[] => {
  const { file, screen } = questScreen(source)
  const declaration = screen?.body?.statements.flatMap((statement) =>
    ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : [],
  ).find((node) => ts.isIdentifier(node.name) && node.name.text === 'isLoading')
  const flatten = (expression: ts.Expression): string[] => {
    if (ts.isBinaryExpression(expression) && expression.operatorToken.kind === ts.SyntaxKind.BarBarToken) {
      return [...flatten(expression.left), ...flatten(expression.right)]
    }
    return [expression.getText(file).replace(/\s+/g, '')]
  }
  return declaration?.initializer ? flatten(declaration.initializer) : []
}
