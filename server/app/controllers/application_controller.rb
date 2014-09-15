require 'jsonapi/resource_controller'

class ApplicationController < JSONAPI::ResourceController
	# protect_from_forgery with: :null_session

  	def context
    	# {current_user: current_user}
  	end 	
end
