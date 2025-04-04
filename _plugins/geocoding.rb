require 'net/http'
require 'json'
require 'uri'
require 'concurrent'
require 'digest'

module Jekyll
  class GeocodingGenerator < Generator
    safe true
    priority :high

    MAX_RETRIES = 3
    INITIAL_TIMEOUT = 5
    MAX_TIMEOUT = 15
    BACKOFF_FACTOR = 1.5

    def geocode_with_retry(address, attempt = 1)
      timeout = [INITIAL_TIMEOUT * (BACKOFF_FACTOR ** (attempt - 1)), MAX_TIMEOUT].min
      
      full_address = address.downcase.include?('sherbrooke') ? address : "#{address}, Sherbrooke, QC"
      encoded_address = URI.encode_www_form_component(full_address)
      url = "https://nominatim.openstreetmap.org/search?q=#{encoded_address}&format=json&limit=1"
      
      uri = URI(url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = true
      http.read_timeout = timeout
      http.open_timeout = timeout
      request = Net::HTTP::Get.new(uri)
      request["User-Agent"] = "BlogCulinaire/1.0"
      
      response = http.request(request)
      
      if response.is_a?(Net::HTTPSuccess)
        result = JSON.parse(response.body)
        return result if result.any?
      end
      
      nil
    rescue Net::ReadTimeout, Net::OpenTimeout => e
      if attempt < MAX_RETRIES
        sleep(1.0 * attempt)
        retry_result = geocode_with_retry(address, attempt + 1)
        return retry_result if retry_result
      end
      raise e
    end

    def generate(site)
      Jekyll.logger.info "Geocoding:", "Starting geocoding process..."
      
      data_dir = File.join(site.source, '_data')
      FileUtils.mkdir_p(data_dir) unless File.directory?(data_dir)
      
      cache_file = File.join(data_dir, 'geocoding_cache.json')
      cache = File.exist?(cache_file) ? JSON.parse(File.read(cache_file)) : {}
      
      # Charger la liste des restaurants déjà géocodés
      geocoded_file = File.join(data_dir, 'geocoded_restaurants.json')
      geocoded_restaurants = File.exist?(geocoded_file) ? JSON.parse(File.read(geocoded_file)) : []
      
      restaurants = site.posts.docs.select { |post| post.data['layout'] == 'restaurant' }
      total_posts = restaurants.size
      geocoded = Concurrent::AtomicFixnum.new(0)
      to_geocode = []
      newly_geocoded = []
      
      # Premier passage : utiliser le cache et identifier les restaurants à géocoder
      restaurants.each do |post|
        next unless post.data['address']
        
        address = post.data['address']
        cache_key = Digest::MD5.hexdigest(address)
        
        # Vérifier si le restaurant est déjà dans le cache
        if cache[cache_key]
          post.data['latitude'] = cache[cache_key]['lat']
          post.data['longitude'] = cache[cache_key]['lng']
          geocoded.increment
          
          # Ajouter à la liste des restaurants géocodés s'il n'y est pas déjà
          unless geocoded_restaurants.include?(post.data['title'])
            newly_geocoded << post.data['title']
          end
          
          next
        end
        
        # Vérifier si le restaurant a déjà été géocodé lors d'un build précédent
        if geocoded_restaurants.include?(post.data['title'])
          Jekyll.logger.info "Geocoding:", "Skipping #{post.data['title']} - already geocoded in a previous build"
          next
        end
        
        to_geocode << [post, address, cache_key]
      end
      
      return if to_geocode.empty?
      
      Jekyll.logger.info "Geocoding:", "Found #{to_geocode.size} new restaurants to geocode"
      
      # Configuration du pool de threads
      thread_count = [to_geocode.size, 3].min
      pool = Concurrent::FixedThreadPool.new(thread_count)
      semaphore = Concurrent::Semaphore.new(2)
      futures = []
      
      # Géocodage en parallèle
      to_geocode.each do |post, address, cache_key|
        futures << Concurrent::Future.execute(executor: pool) do
          semaphore.acquire
          begin
            result = geocode_with_retry(address)
            
            if result
              post.data['latitude'] = result[0]['lat'].to_f
              post.data['longitude'] = result[0]['lon'].to_f
              
              cache[cache_key] = {
                'lat' => post.data['latitude'],
                'lng' => post.data['longitude'],
                'address' => address,
                'updated_at' => Time.now.to_i
              }
              
              geocoded.increment
              newly_geocoded << post.data['title']
              Jekyll.logger.info "Geocoding:", "Successfully geocoded #{post.data['title']}"
            else
              Jekyll.logger.error "Geocoding:", "No results found for #{post.data['title']} (#{address})"
            end
          rescue => e
            Jekyll.logger.error "Geocoding:", "Failed to geocode #{post.data['title']} after #{MAX_RETRIES} attempts: #{e.message}"
          ensure
            semaphore.release
            sleep 0.5
          end
        end
      end
      
      # Attendre la fin des requêtes
      futures.each(&:value)
      
      # Sauvegarder le cache
      File.write(cache_file, JSON.pretty_generate(cache))
      
      # Mettre à jour la liste des restaurants géocodés
      geocoded_restaurants = (geocoded_restaurants + newly_geocoded).uniq
      File.write(geocoded_file, JSON.pretty_generate(geocoded_restaurants))
      
      Jekyll.logger.info "Geocoding:", "Completed! #{geocoded.value}/#{total_posts} restaurants geocoded successfully"
      Jekyll.logger.info "Geocoding:", "#{newly_geocoded.size} new restaurants were geocoded in this build"
    end
  end
end 