require 'net/http'
require 'json'
require 'uri'
require 'concurrent'

module Jekyll
  class GeocodingGenerator < Generator
    safe true
    priority :high

    def generate(site)
      Jekyll.logger.info "Geocoding:", "Starting geocoding process..."
      
      data_dir = File.join(site.source, '_data')
      FileUtils.mkdir_p(data_dir) unless File.directory?(data_dir)
      
      cache_file = File.join(data_dir, 'geocoding_cache.json')
      cache = File.exist?(cache_file) ? JSON.parse(File.read(cache_file)) : {}
      
      restaurants = site.posts.docs.select { |post| post.data['layout'] == 'restaurant' }
      total_posts = restaurants.size
      geocoded = Concurrent::AtomicFixnum.new(0)
      
      # Créer un pool de threads pour le géocodage parallèle
      pool = Concurrent::FixedThreadPool.new(5)
      futures = []

      restaurants.each do |post|
        next unless post.data['address']
        
        address = post.data['address']
        
        if cache[address]
          post.data['latitude'] = cache[address]['lat']
          post.data['longitude'] = cache[address]['lng']
          geocoded.increment
          Jekyll.logger.info "Geocoding:", "Using cached coordinates for #{post.data['title']}"
          next
        end

        futures << Concurrent::Future.execute(executor: pool) do
          full_address = address.downcase.include?('sherbrooke') ? address : "#{address}, Sherbrooke, QC"
          encoded_address = URI.encode_www_form_component(full_address)
          url = "https://nominatim.openstreetmap.org/search?q=#{encoded_address}&format=json&limit=1"
          
          begin
            uri = URI(url)
            http = Net::HTTP.new(uri.host, uri.port)
            http.use_ssl = true
            http.read_timeout = 5
            http.open_timeout = 5
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
                
                geocoded.increment
                Jekyll.logger.info "Geocoding:", "Successfully geocoded #{post.data['title']}"
                true
              else
                Jekyll.logger.error "Geocoding:", "No results found for #{post.data['title']} (#{full_address})"
                false
              end
            else
              Jekyll.logger.error "Geocoding:", "HTTP error for #{post.data['title']}: #{response.code}"
              false
            end
          rescue => e
            Jekyll.logger.error "Geocoding:", "Failed to geocode #{post.data['title']}: #{e.message}"
            false
          ensure
            sleep 0.2 # Réduit le délai d'attente à 200ms
          end
        end
      end

      # Attendre que toutes les requêtes soient terminées
      futures.each(&:value)
      
      # Sauvegarder le cache une seule fois à la fin
      File.write(cache_file, JSON.pretty_generate(cache))
      
      Jekyll.logger.info "Geocoding:", "Completed! #{geocoded.value}/#{total_posts} restaurants geocoded successfully"
    end
  end
end 