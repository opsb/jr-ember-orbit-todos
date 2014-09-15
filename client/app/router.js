import Ember from 'ember';

var Router = Ember.Router.extend({
  location: TodosENV.locationType
});

Router.map(function() {
	this.resource('user', {path: '/user/:user_id'}, function(){
		this.resource('todos', function(){});
	});
});

export default Router;
