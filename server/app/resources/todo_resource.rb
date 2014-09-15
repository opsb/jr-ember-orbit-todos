require 'jsonapi/resource'

class TodoResource < JSONAPI::Resource
	attributes :id, :title, :description
	has_one :user
end