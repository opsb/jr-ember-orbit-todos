require 'spec_helper'

describe UsersController do
	context "GET index with includes" do
		before do
			get :index, x: 'y'
		end

		it "should include todos in response" do
			puts response.body
			json = JSON.parse(response.body)
			json['todos'].should_not be_nil
		end
	end
end