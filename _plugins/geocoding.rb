require 'net/http'
require 'json'
require 'uri'

module Jekyll
  class GeocodingGenerator < Generator
    safe true
    priority :high

    def generate(site)
      site.posts.docs.each do |post|
        next unless post.data['layout'] == 'restaurant' && post.data['address']
        
        # Cache les coordonnées pour éviter trop d'appels API
        cache_file = File.join(site.source, '_data', 'geocoding_cache.json')
        cache = File.exist?(cache_file) ? JSON.parse(File.read(cache_file)) : {}
        
        address = post.data['address']
        
        if cache[address]
          post.data['latitude'] = cache[address]['lat']
          post.data['longitude'] = cache[address]['lng']
        else
          # Utilise OpenStreetMap Nominatim pour le géocodage
          encoded_address = URI.encode_www_form_component(address)
          url = "https://nominatim.openstreetmap.org/search?q=#{encoded_address}&format=json&limit=1"
          
          begin
            uri = URI(url)
            response = Net::HTTP.get_response(uri)
            
            if response.is_a?(Net::HTTPSuccess)
              result = JSON.parse(response.body)
              if result.any?
                post.data['latitude'] = result[0]['lat'].to_f
                post.data['longitude'] = result[0]['lon'].to_f
                
                # Met à jour le cache
                cache[address] = {
                  'lat' => post.data['latitude'],
                  'lng' => post.data['longitude']
                }
                
                # Sauvegarde le cache
                FileUtils.mkdir_p(File.dirname(cache_file))
                File.write(cache_file, JSON.pretty_generate(cache))
              end
            end
            
            # Respecte la politique d'utilisation équitable de Nominatim
            sleep 1
          rescue => e
            Jekyll.logger.error "Geocoding Error:", "Failed to geocode #{address}: #{e.message}"
          end
        end
      end
    end
  end
end 