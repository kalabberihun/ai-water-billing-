from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

class Command(BaseCommand):
    help = "Resets all user passwords to 'admin123' so they are not lost during testing."

    def add_arguments(self, parser):
        parser.add_argument(
            '--password',
            type=str,
            default='admin123',
            help='The password to set for all users'
        )

    def handle(self, *args, **options):
        User = get_user_model()
        new_password = options['password']
        
        users = User.objects.all()
        count = 0
        
        for user in users:
            user.set_password(new_password)
            user.save(update_fields=['password'])
            count += 1
            
        self.stdout.write(self.style.SUCCESS(f"Successfully reset passwords for {count} users to '{new_password}'."))
