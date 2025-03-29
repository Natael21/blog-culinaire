require 'net/http'
require 'json'
require 'uri'

module Jekyll
  class GeocodingGenerator < Generator
    safe true
    priority :high

    def generate(site)
      Jekyll.logger.info "Geocoding:", "Starting geocoding process..."
      
      # Créer le dossier _data s'il n'existe pas
      data_dir = File.join(site.source, '_data')
      FileUtils.mkdir_p(data_dir) unless File.directory?(data_dir)
      
      # Initialiser ou charger le cache
      cache_file = File.join(data_dir, 'geocoding_cache.json')
      cache = File.exist?(cache_file) ? JSON.parse(File.read(cache_file)) : {}
      
      total_posts = site.posts.docs.count { |post| post.data['layout'] == 'restaurant' }
      processed = 0
      geocoded = 0
      
      site.posts.docs.each do |post|
        next unless post.data['layout'] == 'restaurant'
        processed += 1
        
        if !post.data['address']
          Jekyll.logger.warn "Geocoding:", "No address found for #{post.data['title']}"
          next
        end
        
        address = post.data['address']
        Jekyll.logger.info "Geocoding:", "Processing (#{processed}/#{total_posts}): #{post.data['title']}"
        
        if cache[address]
          post.data['latitude'] = cache[address]['lat']
          post.data['longitude'] = cache[address]['lng']
          geocoded += 1
          Jekyll.logger.info "Geocoding:", "Using cached coordinates for #{post.data['title']}"
        else
          # Ajouter "Sherbrooke, QC" si non présent dans l'adresse
          full_address = address.downcase.include?('sherbrooke') ? address : "#{address}, Sherbrooke, QC"
          encoded_address = URI.encode_www_form_component(full_address)
          url = "https://nominatim.openstreetmap.org/search?q=#{encoded_address}&format=json&limit=1"
          
          begin
            uri = URI(url)
            http = Net::HTTP.new(uri.host, uri.port)
            http.use_ssl = true
            request = Net::HTTP::Get.new(uri)
            request["User-Agent"] = "BlogCulinaire/1.0"
            response = http.request(request)
            
            if response.is_a?(Net::HTTPSuccess)
              result = JSON.parse(response.body)
              if result.any?
                post.data['latitude'] = result[0]['lat'].to_f
                post.data['longitude'] = result[0]['lon'].to_f
                
                cache[address] = {
                  'lat' => post.data['latitude'],
                  'lng' => post.data['longitude']
                }
                
                File.write(cache_file, JSON.pretty_generate(cache))
                geocoded += 1
                Jekyll.logger.info "Geocoding:", "Successfully geocoded #{post.data['title']}"
              else
                Jekyll.logger.error "Geocoding:", "No results found for #{post.data['title']} (#{full_address})"
              end
            else
              Jekyll.logger.error "Geocoding:", "HTTP error for #{post.data['title']}: #{response.code}"
            end
            
            sleep 1 # Respecter la politique d'utilisation équitable
          rescue => e
            Jekyll.logger.error "Geocoding:", "Failed to geocode #{post.data['title']}: #{e.message}"
          end
        end
      end
      
      Jekyll.logger.info "Geocoding:", "Completed! #{geocoded}/#{total_posts} restaurants geocoded successfully"
    end
  end
end 