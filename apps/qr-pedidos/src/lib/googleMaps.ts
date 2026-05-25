import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  v: 'weekly',
  libraries: ['places'],
})

export async function getPlacesAutocomplete() {
  await importLibrary('places')
  return google.maps.places
}
