import Ember from 'ember';

export default Ember.Route.extend({
	model: function(){
		window.store = this.store;
		return this.store.find('user');
	},

	actions: {
		addUser: function(){
			console.log("adding");
			var controller = this.get("controller");
			this.store.add('user', controller.getProperties("firstName", "lastName", "email")).then(function(user){
				controller.get("model").pushObject(user);
			});
		}
	}
});