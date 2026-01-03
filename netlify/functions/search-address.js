exports.handler = async function(event, context) {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Get the query parameter
        const query = event.queryStringParameters?.q;
        
        if (!query) {
            return {
                statusCode: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ error: 'Missing query parameter "q"' })
            };
        }

        // Build the Nominatim API URL with all query parameters
        const params = new URLSearchParams({
            format: 'json',
            q: query,
            limit: event.queryStringParameters?.limit || '5',
            addressdetails: event.queryStringParameters?.addressdetails || '1'
        });
        
        // Add optional parameters if provided
        if (event.queryStringParameters?.countrycodes) {
            params.append('countrycodes', event.queryStringParameters.countrycodes);
        }
        
        const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

        // Fetch from Nominatim API with proper headers
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'CritiqueResto/1.0 (contact@critiqueresto.com)', // Required by Nominatim usage policy
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API error: ${response.status}`);
        }

        const data = await response.json();

        // Return the data with CORS headers
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        console.error('Error in search-address function:', error);
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: error.message || 'Internal server error' })
        };
    }
};

