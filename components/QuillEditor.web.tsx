import ReactQuill from 'react-quill'

try {
  const Quill = (ReactQuill as any).Quill
  if (Quill && !Quill.__METRAVEL_ID_ATTR_REGISTERED__) {
    const Parchment = Quill.import('parchment')
    const IdAttribute = new Parchment.Attributor.Attribute('id', 'id', {
      scope: Parchment.Scope.INLINE,
    })
    Quill.register(IdAttribute, true)

    Quill.__METRAVEL_ID_ATTR_REGISTERED__ = true
  }
} catch {
  void 0
}

export default ReactQuill
