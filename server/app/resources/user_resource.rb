require 'jsonapi/resource'

class UserResource < JSONAPI::Resource
	attributes :id, :email, :first_name, :last_name, :created_at, :updated_at
	has_many :todos, acts_as_set: true
end