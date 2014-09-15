class Rack::JsonFormatter
	REQUEST_BODY_KEY = "action_dispatch.request.request_parameters"

	def initialize(app) 
		@app = app 
	end 

	def call(env)
		if env
			env[REQUEST_BODY_KEY] = format_request(env[REQUEST_BODY_KEY])
		end

		puts env[REQUEST_BODY_KEY]
		status, headers, body = @app.call(env) 

		if status == 200
			body = format_response(extract_body(body)).split
		end

		return [status, headers, body] 
	end

	def extract_body(body_proxy)
		lines = []
		body_proxy.each{ |line| lines << line }
		lines.join.tap{|x|puts x}
	end

	def format_request(body)
		convert_hash_keys(body){ |key| key.to_s.underscore }
	end

	def format_response(body)
		convert_hash_keys(JSON.parse(body)){ |key| key.to_s.camelize(:lower) }.to_json
	end

	def convert_hash_keys(value, &block)
		case value
		when Array
			value.map { |v| convert_hash_keys(v, &block) }
		when Hash
			Hash[value.map{ |k, v| [(yield k), convert_hash_keys(v, &block)] }]
		else
			value
		end
	end 
end 