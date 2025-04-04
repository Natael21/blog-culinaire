require 'net/http'
require 'json'
require 'uri'
require 'concurrent'
require 'digest'

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
      to_geocode = []
      
      # Premier passage : utiliser le cache et identifier les restaurants à géocoder
      restaurants.each do |post|
        next unless post.data['address']
        
        address = post.data['address']
        cache_key = Digest::MD5.hexdigest(address)
        
        if cache[cache_key]
          post.data['latitude'] = cache[cache_key]['lat']
          post.data['longitude'] = cache[cache_key]['lng']
          geocoded.increment
          next
        end
        
        to_geocode << [post, address, cache_key]
      end
      
      return if to_geocode.empty?
      
      # Configuration du pool de threads
      thread_count = [to_geocode.size, 10].min
      pool = Concurrent::FixedThreadPool.new(thread_count)
      semaphore = Concurrent::Semaphore.new(5) # Limite les requêtes simultanées
      futures = []
      
      # Géocodage en parallèle
      to_geocode.each do |post, address, cache_key|
        futures << Concurrent::Future.execute(executor: pool) do
          semaphore.acquire
          begin
            full_address = address.downcase.include?('sherbrooke') ? address : "#{address}, Sherbrooke, QC"
            encoded_address = URI.encode_www_form_component(full_address)
            url = "https://nominatim.openstreetmap.org/search?q=#{encoded_address}&format=json&limit=1"
            
            uri = URI(url)
            http = Net::HTTP.new(uri.host, uri.port)
            http.use_ssl = true
            http.read_timeout = 3
            http.open_timeout = 3
            request = Net::HTTP::Get.new(uri)
            request["User-Agent"] = "BlogCulinaire/1.0"
            response = http.request(request)
            
            if response.is_a?(Net::HTTPSuccess)
              result = JSON.parse(response.body)
              if result.any?
                post.data['latitude'] = result[0]['lat'].to_f
                post.data['longitude'] = result[0]['lon'].to_f
                
                cache[cache_key] = {
                  'lat' => post.data['latitude'],
                  'lng' => post.data['longitude'],
                  'address' => address,
                  'updated_at' => Time.now.to_i
                }
                
                geocoded.increment
                true
              end
            end
          rescue => e
            Jekyll.logger.error "Geocoding:", "Failed to geocode #{post.data['title']}: #{e.message}"
            false
          ensure
            semaphore.release
            sleep 0.1
          end
        end
      end
      
      # Attendre la fin des requêtes
      futures.each(&:value)
      
      # Sauvegarder le cache
      File.write(cache_file, JSON.pretty_generate(cache))
      
      Jekyll.logger.info "Geocoding:", "Completed! #{geocoded.value}/#{total_posts} restaurants geocoded successfully"
    end
  end
end 