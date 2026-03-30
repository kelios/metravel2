// Re-export from refactored modules for backward compatibility.
// New code should import from '@/utils/mapSnapshot' directly.
export {
  generateStaticMapUrl,
  generateMapImageFromDOM,
  fetchImageAsDataUri,
  generateCanvasMapSnapshot,
  generateLeafletRouteSnapshot,
} from '@/utils/mapSnapshot'
